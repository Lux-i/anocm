//import { EncryptionService } from "./Encryption";

//temp
type ExchangeInfo = {
  dhKeypair: CryptoKeyPair | null;
  sharedKey: CryptoKey | null;
  active: boolean;
  error: boolean;
  status: Status;
  role: Role;
};

enum Role {
  REQUEST,
  SEND,
}

enum Status {
  INIT,
  PENDING,
  CLOSED,
}

export class KeyExchangeService {
  exchanges: Map<string, ExchangeInfo>;

  constructor() {
    this.exchanges = new Map<string, ExchangeInfo>();
  }

  private generateExchangeIdentifier = (chatId: string, userId: string) => {
    return chatId + userId;
  };

  private initExchange = (exchangeId: string, role: Role) => {
    if (!this.exchanges.has(exchangeId)) {
      const exchangeInfo: ExchangeInfo = {
        dhKeypair: null,
        sharedKey: null,
        active: true,
        error: false,
        status: Status.INIT,
        role: role,
      };

      this.exchanges.set(exchangeId, exchangeInfo);
      return true;
    } else {
      return false;
    }
  };

  public startExchange = async (chatId: string, userId: string, role: Role) => {
    const exchangeId = this.generateExchangeIdentifier(chatId, userId);
    if (this.initExchange(exchangeId, role)) {
      //resolve promise
      Promise.resolve(exchangeId);
      //create dhKeypair
      //set keyPair
    } else {
      Promise.reject();
    }
  };
}
