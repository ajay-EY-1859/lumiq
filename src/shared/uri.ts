export class URI {
  static file(path: string): URI {
    // Convert backslashes to forward slashes for cross-platform consistency
    let normalizedPath = path.replace(/\\/g, '/');
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    return new URI('file', '', normalizedPath);
  }

  static parse(value: string): URI {
    try {
      const url = new URL(value);
      return new URI(url.protocol.slice(0, -1), url.host, url.pathname);
    } catch {
      // Fallback for simple paths without scheme or containing invalid URL chars
      if (value.includes('://')) {
        const parts = value.split('://');
        const scheme = parts[0];
        const rest = parts[1];
        const slashIdx = rest.indexOf('/');
        if (slashIdx === -1) {
          return new URI(scheme, rest, '/');
        } else {
          return new URI(scheme, rest.slice(0, slashIdx), rest.slice(slashIdx));
        }
      }
      return URI.file(value);
    }
  }

  constructor(
    readonly scheme: string,
    readonly authority: string,
    readonly path: string
  ) {}

  get fsPath(): string {
    if (this.scheme === 'file') {
      let p = this.path;
      if (process.platform === 'win32') {
        if (p.startsWith('/') && p.match(/^\/[a-zA-Z]:/)) {
          p = p.slice(1);
        }
        return p.replace(/\//g, '\\');
      }
      return p;
    }
    return this.path;
  }

  isEqual(other: URI): boolean {
    if (this.scheme !== other.scheme) return false;
    if (this.authority !== other.authority) return false;
    const pathA = process.platform === 'win32' ? this.path.toLowerCase() : this.path;
    const pathB = process.platform === 'win32' ? other.path.toLowerCase() : other.path;
    return pathA === pathB;
  }

  toString(): string {
    const authorityPart = this.authority ? `//${this.authority}` : '';
    return `${this.scheme}:${authorityPart}${this.path}`;
  }
}
