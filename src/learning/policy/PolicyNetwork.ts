export interface PolicyNetwork {
  predict(state: any): Promise<any>;
}
