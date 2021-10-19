module Constants is {
  [@inline] const zero_address : address = ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);

  [@inline] const fee_num : nat = 997n;

  [@inline] const fee_denom : nat = 1000n;

  [@inline] const default_token_metadata : map(string, bytes) = map [
    "name" -> 0x517569707573776170204c5020546f6b656e;
    "symbol" -> 0x515054;
    "decimals" -> 0x36;
    "description" -> 0x517569707573776170204c5020746f6b656e20726570726573656e7473207573657220736861726520696e20746865206c697175696469747920706f6f6c;
    "shouldPreferSymbol" -> 0x74727565;
    "thumbnailUri" -> 0x68747470733a2f2f7175697075737761702e636f6d2f51504c502e706e67;
  ];
}
