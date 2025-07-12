<script lang="ts">
  interface Props {
    location: string;
    temp_c: number;
    condition: string;
    ts: string;
  }

  let { location, temp_c, condition, ts }: Props = $props();

  // Format temperature
  const tempF = Math.round((temp_c * 9/5) + 32);
  
  // Format timestamp
  const formattedDate = new Date(ts).toLocaleString();
  
  // Get weather emoji
  function getWeatherEmoji(condition: string): string {
    const lower = condition.toLowerCase();
    if (lower.includes('sunny') || lower.includes('clear')) return '☀️';
    if (lower.includes('cloud')) return '☁️';
    if (lower.includes('rain')) return '🌧️';
    if (lower.includes('snow')) return '❄️';
    if (lower.includes('storm')) return '⛈️';
    return '🌤️';
  }
</script>

<div class="bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-lg p-4 shadow-lg">
  <div class="flex items-center justify-between mb-2">
    <h3 class="text-lg font-semibold">{location}</h3>
    <span class="text-3xl">{getWeatherEmoji(condition)}</span>
  </div>
  
  <div class="flex items-center justify-between mb-3">
    <div class="text-3xl font-bold">{temp_c}°C</div>
    <div class="text-right">
      <div class="text-sm opacity-90">{tempF}°F</div>
      <div class="text-sm opacity-75">{condition}</div>
    </div>
  </div>
  
  <div class="text-xs opacity-75 border-t border-white/20 pt-2">
    Updated: {formattedDate}
  </div>
</div> 