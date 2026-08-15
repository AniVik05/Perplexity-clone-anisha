import { BaseOutputParser } from '@langchain/core/output_parsers';

interface ListLineOutputParserArgs {
  key?: string;
}

/**
 * Assignment note: this is described as "already given in lib/outputParsers/".
 * Recreated here from the spec (pulls newline-separated items out of
 * <key>...</key> XML tags) so the project compiles standalone — replace with
 * your actual given file if it differs.
 */
class ListLineOutputParser extends BaseOutputParser<string[]> {
  private key = 'suggestions';

  constructor(args?: ListLineOutputParserArgs) {
    super();
    if (args?.key) {
      this.key = args.key;
    }
  }

  static lc_name() {
    return 'ListLineOutputParser';
  }

  lc_namespace = ['langchain', 'output_parsers', 'list_line_output_parser'];

  async parse(text: string): Promise<string[]> {
    const regex = /^(\s*(-|\*|\d+\.\s|\d+\)\s|<[^>]+>))/;
    const startKeyIndex = text.indexOf(`<${this.key}>`);
    const endKeyIndex = text.indexOf(`</${this.key}>`);

    if (startKeyIndex === -1 || endKeyIndex === -1) {
      return [];
    }

    const startIndex =
      startKeyIndex === -1 ? 0 : startKeyIndex + `<${this.key}>`.length;
    const endIndex = endKeyIndex === -1 ? text.length : endKeyIndex;

    return text
      .slice(startIndex, endIndex)
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(regex, '').trim());
  }

  getFormatInstructions(): string {
    throw new Error('Not implemented');
  }
}

export default ListLineOutputParser;
