/** One in-memory form intent survives a failed response; an edit or confirmed success starts a new one. */
export class CreateIntent {
  private body?: string;
  private scope?: string;
  private token?: string;
  headers(scope: string, body: string): Record<string,string> {
    if(this.scope!==scope||this.body!==body||!this.token){
      this.scope=scope;this.body=body;
      this.token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
    }
    return {'Idempotency-Key':this.token};
  }
  reset(){this.body=undefined;this.scope=undefined;this.token=undefined;}
}
