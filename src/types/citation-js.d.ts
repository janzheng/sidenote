declare module '@citation-js/core' {
  export class Cite {
    constructor(input: string | object);
    format(format: string, options?: any): string;
  }
}

declare module '@citation-js/plugin-bibtex';
declare module '@citation-js/plugin-csl'; 
declare module '@citation-js/plugin-doi';