const { assertError } = require('../../scripts/eosio-errors')

class TokenUtil {

  static tokenCode = 'TLOS'
  static tokenPrecision = 4

  static async create ({ issuer, maxSupply, contractAccount, contract }) {
    try {
      await contract.create(issuer, maxSupply, { authorization: `${contractAccount}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'token with symbol already exists',
        verbose: false
      })
    }
  }

  static async issue ({ amount, issuer, contract }) {
    await contract.issue(issuer, amount, 'issued token', { authorization: `${issuer}@active` })
  }

  static async createFromDao ({dao_id, token_contract, token, daoCreator, contract}) {
    try {
      await contract.addtoken(dao_id, token_contract, token, { authorization: `${daoCreator}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'This token symbol is already added',
        verbose: false
      })
    }
  }

}

module.exports = { TokenUtil }