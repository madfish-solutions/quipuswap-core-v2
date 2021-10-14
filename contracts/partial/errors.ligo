module DexCore is {
  const err_unknown_func       : nat = 0n;
  const err_func_set           : nat = 1n;
  const err_high_func_index    : nat = 2n;
  const err_cant_unpack_lambda : nat = 3n;
  const err_wrong_pair_order   : nat = 4n;
  const err_zero_a_in          : nat = 5n;
  const err_zero_b_in          : nat = 6n;
  const err_pair_listed        : nat = 7n;
  const err_pair_not_listed    : nat = 8n;
}

module Common is {
  const err_not_admin                    : nat = 0n;
  const err_not_pending_admin            : nat = 1n;
  const err_not_manager                  : nat = 2n;
  const err_fa12_transfer_entrypoint_404 : nat = 3n;
  const err_fa2_transfer_entrypoint_404  : nat = 4n;
}
