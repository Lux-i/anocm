//import { EncryptionService } from "./Encryption";

//temp
type ExchangeInfo = {
  dhKeypair: CryptoKeyPair | null;
  sharedKey: CryptoKey | null;
  active: boolean;
  error: boolean;
  status: string;
};

export class KeyExchangeService {
  exchanges: Map<string, ExchangeInfo>;

  constructor() {
    this.exchanges = new Map<string, ExchangeInfo>();
  }

  private generateExchangeIdentifier = (chatId: string, userId: string) => {
    return chatId + userId;
  };

  private initExchange = (exchangeId: string) => {
    if (!this.exchanges.has(exchangeId)) {
      const exchangeInfo: ExchangeInfo = {
        dhKeypair: null,
        sharedKey: null,
        active: true,
        error: false,
        status: "init",
      };

      this.exchanges.set(exchangeId, exchangeInfo);
      return true;
    } else {
      return false;
    }
  };

  public startExchange = async (chatId: string, userId: string) => {
    const exchangeId = this.generateExchangeIdentifier(chatId, userId);
    if (this.initExchange(exchangeId)) {
      //resolve promise
      Promise.resolve(exchangeId);
      //create dhKeypair
      //set keyPair
    } else {
      Promise.reject();
    }
  };
}
