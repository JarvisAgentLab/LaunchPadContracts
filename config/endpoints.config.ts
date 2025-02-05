export enum SendType {
  SEND = 1,
  SEND_AND_CALL,
}

export const mainnet = ["mainnet", "base"];
export const testnet = ["sepolia", "base_sepolia"];

export const endpointV2: any = {
  mainnet: {
    address: "0x1a44076050125825900e736c501f859c50fE728c",
    eid: 30101,
  },
  base: {
    address: "0x1a44076050125825900e736c501f859c50fE728c",
    eid: 30184,
  },

  // Testnet
  sepolia: {
    address: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    eid: 40161,
  },
  base_sepolia: {
    address: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    eid: 40245,
  },
};
