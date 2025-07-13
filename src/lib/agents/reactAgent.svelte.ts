import { GroqService } from '../services/groqService.svelte';
import type { ChatMessage } from '../../types/chatMessage';
import type { AgentContent } from './registry.svelte';
import { AgentContent as AgentContentSchema, loadComponent, validateComponentProps, sanitize } from './registry.svelte';
import type { AgentTool } from './tools.svelte';
import { getAgentTools, executeToolCall } from './tools.svelte';

interface ReActState {
  isRunning: boolean;
  content: AgentContent[];
  error: string | null;
  abortController: AbortController | null;
  conversationHistory: ChatMessage[];
  memory: Record<string, any>;
}

export class ReActAgent {
  private state = $state<ReActState>({
    isRunning: false,
    content: [],
    error: null,
    abortController: null,
    conversationHistory: [],
    memory: {}
  });

  // Getters for reactive state
  get isRunning() {
    return this.state.isRunning;
  }

  get content() {
    return this.state.content;
  }

  get error() {
    return this.state.error;
  }

  get conversationHistory() {
    return this.state.conversationHistory;
  }

  get memory() {
    return this.state.memory;
  }

  // Push content to the stream with validation
  private push(item: AgentContent) {
    const validation = AgentContentSchema.safeParse(item);
    if (!validation.success) {
      console.warn('Invalid content item:', validation.error);
      this.state.content = [...this.state.content, {
        type: 'comment',
        text: sanitize('⚠️ Invalid content was filtered out')
      }];
      return;
    }
    
    this.state.content = [...this.state.content, validation.data];
  }

  // Clear the content stream but preserve conversation history
  clear() {
    this.state.content = [];
    this.state.error = null;
  }

  // Clear everything including history (for new conversations)
  clearAll() {
    this.state.content = [];
    this.state.error = null;
    this.state.conversationHistory = [];
    this.state.memory = {};
  }

  // Stop the current agent run
  stop() {
    if (this.state.abortController) {
      this.state.abortController.abort();
      this.state.abortController = null;
    }
    this.state.isRunning = false;
  }

  // Main ReAct agent loop
  async runAgent(
    userMessage: string,
    pageContent?: string,
    maxIterations: number = 25,
    customTools?: AgentTool[],
    customContext?: string,
    customSystemPrompt?: string
  ) {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;
    this.state.error = null;
    this.state.abortController = new AbortController();

    try {
      console.log('🤖 Starting ReAct agent with message:', userMessage);

      // Add user message to stream
      this.push({
        type: 'text',
        content: `**User:** ${userMessage}`
      });

      // Get available tools (use custom tools if provided)
      const tools = customTools || getAgentTools();
      const toolsPrompt = this.formatToolsForPrompt(tools);

      // Combine page content with custom context
      const combinedContext = customContext ? 
        `${customContext}\n\n${pageContent || ''}`.trim() : 
        pageContent;

      // Build conversation with preserved history
      const systemMessage: ChatMessage = {
        role: 'system',
        content: customSystemPrompt || this.getSystemPrompt(toolsPrompt, combinedContext)
      };

      // Start with system message and preserved history
      const conversation: ChatMessage[] = [systemMessage];
      
      // Add memory context if we have any
      if (Object.keys(this.state.memory).length > 0) {
        conversation.push({
          role: 'system',
          content: `Memory from previous interactions: ${JSON.stringify(this.state.memory)}`
        });
      }
      
      // Add preserved conversation history (excluding old system messages)
      const historyWithoutSystem = this.state.conversationHistory.filter(msg => msg.role !== 'system');
      conversation.push(...historyWithoutSystem);
      
      // Add current user message
      const newUserMessage: ChatMessage = {
        role: 'user',
        content: userMessage
      };
      conversation.push(newUserMessage);
      
      // Add to preserved history
      this.state.conversationHistory.push(newUserMessage);
      
      // Debug: Log conversation length
      const totalTokens = conversation.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
      console.log(`🧠 Conversation tokens: ~${Math.ceil(totalTokens / 4)} (${conversation.length} messages)`);
      console.log(`📚 History preserved: ${historyWithoutSystem.length} messages`);

      let iteration = 0;
      while (iteration < maxIterations && this.state.isRunning) {
        iteration++;
        console.log(`🔄 ReAct iteration ${iteration}/${maxIterations}`);

        if (this.state.abortController?.signal.aborted) {
          break;
        }

        // Get agent response
        const response = await GroqService.generateText(
          conversation,
          {
            model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
            // model: 'qwen/qwen3-32b',
            temperature: 0.2, // Balanced temperature for reasoning while reducing tool-happy behavior
            maxTokens: 6000 // Increased for more detailed responses
          }
        );

        if (!response.success) {
          this.push({
            type: 'comment',
            text: sanitize(`❌ Agent error: ${response.error || 'No response from AI'}`)
          });
          break;
        }

        if (!response.content || response.content.trim() === '') {
          this.push({
            type: 'comment',
            text: sanitize(`❌ Agent returned empty response. This might be due to content filtering or model issues. Try rephrasing your request or use simpler language.`)
          });
          
          // Try to recover by asking a simpler question
          if (iteration === 1) {
            this.push({
              type: 'text',
              content: 'Let me try to help you with a simpler approach. Could you tell me what specific location or type of places you\'re interested in?'
            });
          }
          break;
        }

        // Add assistant response to conversation and preserve it
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.content
        };
        conversation.push(assistantMessage);
        this.state.conversationHistory.push(assistantMessage);

        // Parse and execute the response
        const shouldContinue = await this.processAgentResponse(
          response.content,
          tools,
          conversation
        );

        if (!shouldContinue) {
          break;
        }
      }

      if (iteration >= maxIterations) {
        this.push({
          type: 'comment',
          text: sanitize('⚠️ Agent reached maximum iterations')
        });
      }

    } catch (error) {
      console.error('❌ ReAct agent error:', error);
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.push({
        type: 'comment',
        text: sanitize(`❌ Agent error: ${this.state.error}`)
      });
    } finally {
      this.state.isRunning = false;
      this.state.abortController = null;
    }
  }

  // Process agent response and execute actions
  private async processAgentResponse(
    responseText: string,
    tools: AgentTool[],
    conversation: ChatMessage[]
  ): Promise<boolean> {
    // Look for thinking sections
    const thinkingMatch = responseText.match(/(?:Thought|Think|Thinking):\s*(.*?)(?=\n(?:Action|Final Answer|$))/is);
    if (thinkingMatch) {
      this.push({
        type: 'thinking',
        content: thinkingMatch[1].trim()
      });
    }

    // Look for tool calls
    const actionMatch = responseText.match(/Action:\s*(\w+)/i);
    const actionInputMatch = responseText.match(/Action Input:\s*({.*?}|\w+.*?)(?=\n|$)/is);

    if (actionMatch && actionInputMatch) {
      const toolName = actionMatch[1];
      let toolParams: any;

      try {
        // Try to parse as JSON first
        toolParams = JSON.parse(actionInputMatch[1]);
      } catch {
        // If not JSON, treat as simple string parameter
        const inputValue = actionInputMatch[1].trim();
        
        // For specific tools, map the input to the expected parameter name
        if (toolName === 'plan_multi_destination_trip') {
          toolParams = { destinations: inputValue };
        } else if (toolName === 'update_multi_destination_trip') {
          toolParams = { action: 'clear_and_replan', destinations: inputValue };
        } else if (toolName === 'get_directions_to') {
          toolParams = { destination: inputValue };
        } else if (toolName === 'find_places_nearby') {
          toolParams = { query: inputValue };
        } else if (toolName === 'web_search') {
          toolParams = { query: inputValue };
        } else if (toolName === 'validate_multi_destination_route') {
          // For validation tool, if we get a simple string, try to parse it as destinations
          // The LLM should provide proper JSON, but this is a fallback
          toolParams = { 
            destinations: inputValue, 
            expected_region: 'International',
            fix_errors: true 
          };
        } else {
          toolParams = { input: inputValue };
        }
      }

      // Simple heuristic: discourage search for very short/simple queries
      if (toolName === 'web_search' && toolParams.query) {
        const query = toolParams.query.toLowerCase();
        const simplePatterns = [
          /^what is \w+\??$/,  // "what is react?"
          /^how does \w+ work\??$/,  // "how does javascript work?"
          /^explain \w+$/,  // "explain ai"
          /^tell me about \w+$/,  // "tell me about python"
        ];
        
        if (simplePatterns.some(pattern => pattern.test(query)) || query.length < 15) {
          console.log(`🚫 Skipping search for simple query: "${query}"`);
          
          // Add a comment and continue conversation to let agent answer directly
          conversation.push({
            role: 'user',
            content: `Observation: Search skipped - this looks like a general knowledge question you can answer directly without tools. Please provide a direct answer.`
          });
          
          return true; // Continue the loop for direct answer
        }
      }

      console.log(`🔧 Executing tool: ${toolName} with params:`, toolParams);
      console.log(`🔧 Raw Action Input: "${actionInputMatch[1]}"`);
      console.log(`🔧 Params type: ${typeof toolParams}, keys:`, Object.keys(toolParams));

      // Execute the tool
      const startTime = Date.now();
      const toolResults = await executeToolCall(
        toolName,
        toolParams,
        this.state.abortController?.signal
      );
      const duration = Date.now() - startTime;

      // Add tool results to stream
      for (const result of toolResults) {
        // Validate component props if it's a component
        if (result.type === 'component') {
          await loadComponent(result.name);
          const validation = validateComponentProps(result.name, result.props);
          
          if (!validation.success) {
            console.error('Invalid component props:', validation.error);
            this.push({
              type: 'comment',
              text: sanitize(`⚠️ Invalid props for "${result.name}": ${validation.error}`)
            });
            continue;
          }
          
          // Update props with validated data
          result.props = validation.data;
        }
        
        this.push(result);
        
        // Update memory with tool results
        if (result.type === 'tool_result' || result.type === 'comment') {
          this.state.memory = {
            ...this.state.memory,
            lastToolUsed: toolName,
            lastMessageAt: Date.now()
          };
        }
      }

      // Add tool result to conversation for agent context with cost feedback
      const toolResultText = toolResults
        .map(r => {
          if (r.type === 'tool_result') {
            return `Observation: ${JSON.stringify(r.data)}`;
          } else if (r.type === 'text') {
            return `Observation: ${r.content}`;
          } else if (r.type === 'component') {
            return `Observation: Displayed ${r.name} component`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      // Add cost feedback to make the agent aware of tool usage
      const costFeedback = `\n(Tool ${toolName} took ${duration}ms - tools are expensive, use sparingly)`;

      if (toolResultText) {
        const toolMessage: ChatMessage = {
          role: 'user',
          content: toolResultText + costFeedback
        };
        conversation.push(toolMessage);
        this.state.conversationHistory.push(toolMessage);
      }

      return true; // Continue the loop
    }

    // Look for final answer
    const finalAnswerMatch = responseText.match(/Final Answer:\s*(.*?)$/is);
    if (finalAnswerMatch) {
      this.push({
        type: 'text',
        content: finalAnswerMatch[1].trim()
      });
      return false; // End the loop
    }

    // If no clear action or final answer, add as text and continue
    this.push({
      type: 'text',
      content: responseText
    });

    return true; // Continue for now
  }

  // Format tools for the prompt
  private formatToolsForPrompt(tools: AgentTool[]): string {
    return tools.map(tool => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, def]) => `${name}: ${def.description}`)
        .join(', ');
      
      return `${tool.name}: ${tool.description}. Parameters: ${params}`;
    }).join('\n');
  }

  // Get the system prompt for the agent
  private getSystemPrompt(toolsPrompt: string, pageContent?: string): string {
    return `You are a helpful ReAct (Reasoning and Acting) agent. You can think step by step and use tools to help users.

🛑 **CRITICAL: Tools are expensive and slow. Only use them when absolutely necessary.**

TOOL USAGE RULES:
- **FIRST**: Try to answer from your general knowledge
- **ONLY use tools when**: You need current/live data, specific searches, or cannot answer from knowledge
- **DON'T use tools for**: General questions, explanations, advice, common knowledge
- Always think before acting
- Use the exact format: "Thought: [your reasoning]" then "Action: [tool_name]" then "Action Input: [parameters]"
- When you have enough information, provide a "Final Answer: [response]"

EXAMPLES OF WHEN **NOT** TO USE TOOLS:
- "Tell me a joke" → Answer directly
- "How does React work?" → Answer from knowledge  
- "What is JavaScript?" → Answer from knowledge
- "Explain machine learning" → Answer from knowledge

EXAMPLES OF WHEN **TO USE TOOLS**:
- "What's the weather in Paris right now?" → Use get_weather_by_location
- "Search for the latest React 19 features" → Use web_search
- "Find recent news about AI" → Use web_search

AVAILABLE TOOLS:
${toolsPrompt}

🚨 **CRITICAL TOOL RULES:**
- Only emit Action when **ALL required arguments are present and valid**
- If the user hasn't provided a location for weather, ASK for it first
- Never use placeholders like "[location]" or "[city]" in tool calls
- If information is missing, ask the user to clarify before calling tools

🚨 **CRITICAL USER INTERACTION RULE:**
- **NEVER assume user consent**: If you ask "Would you like me to..." or "Should I..." or "Do you want..." - ALWAYS wait for the user's explicit response
- **STOP after asking questions**: When you ask the user a question, provide a "Final Answer" and wait for their reply
- **Don't auto-execute**: Never automatically execute tools after asking permission questions

FORMAT EXAMPLES:

**Direct Answer (no tools needed):**
Thought: This is a general knowledge question I can answer directly.
Final Answer: JavaScript is a programming language primarily used for web development...

**Tool Usage (when necessary):**
Thought: I need current weather data for this specific location.
Action: get_weather_by_location
Action Input: {"location": "San Francisco, CA"}

[Tool execution happens here]

Thought: Now I have the current weather data, I can provide the final answer.
Final Answer: The weather in San Francisco is currently 22°C and sunny.

**Asking User Permission (wait for response):**
Thought: The user might want me to search for more information, but I should ask first.
Final Answer: I found some basic information about React. Would you like me to search for the latest React 19 features and updates?

**User Response to Question:**
User: "Yes, please search for React 19 features"
Thought: The user has explicitly requested a search for React 19 features. Now I can execute the search tool.
Action: web_search
Action Input: {"query": "React 19 features updates new"}

${pageContent ? `\nCURRENT PAGE CONTENT:\n${pageContent.slice(0, 2000)}${pageContent.length > 2000 ? '...' : ''}` : ''}

Remember: Think step by step, answer directly when possible, use tools only when necessary for current/specific data. Always wait for user confirmation when asking permission questions.`;
  }
}

// Export singleton instance
export const reactAgent = new ReActAgent(); 