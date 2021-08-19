#include <daoinf.hpp>

ACTION daoinf::reset() {
  require_auth(get_self());

  // user_tables users_t(get_self(), get_self().value);
  // auto uitr = users_t.begin();
  // while(uitr != users_t.end())
  // {
  //   uitr = users_t.erase(uitr);
  // }

}
