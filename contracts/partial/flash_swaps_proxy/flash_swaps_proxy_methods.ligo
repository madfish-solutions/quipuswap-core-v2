function quipuswap_v2_call(
  const call_lambda     : quipu_v2_call_t;
  const s               : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
  } with (call_lambda(Unit), s)
