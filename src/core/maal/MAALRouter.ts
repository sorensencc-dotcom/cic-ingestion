export interface MAALRouter {
  route(input: any): Promise<any>;
}

export class DefaultMAALRouter implements MAALRouter {
  async route(input: any): Promise<any> {
    return input;
  }
}
