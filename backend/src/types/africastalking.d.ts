declare module 'africastalking' {
  interface SMSClient {
    send(opts: any): Promise<any>;
  }

  interface AfricasTalkingStatic {
    SMS: SMSClient;
  }

  function AfricasTalking(opts: { apiKey: string; username: string }): { SMS: any };
  export default AfricasTalking;
}
