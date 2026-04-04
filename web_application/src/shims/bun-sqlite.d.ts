/** Stub so TypeScript can resolve backend imports when typechecking Eden `App` from the backend. */
declare module "bun:sqlite" {
  export class Database {
    constructor(path: string);
  }
}
