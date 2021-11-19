const { createRandomAccount } = require('../../scripts/eosio-util')

const DaoConstants = {
  sell: 0,
  buy: 1,
}

class Dao {

  constructor (
    dao,
    creator,
    ipfs
  ) {
    this.params = {
      dao,
      creator,
      ipfs
    }
  }

  getActionParams () {

    let dao
    if (this.params.dao) {
      dao = this.params.dao
    } else {
      dao = await createRandomAccount() 
    }

    return [
      this.dao,
      this.creator,
      this.ipfs
    ]
  }

}

class DaosFactory {

  static createEntry ({
    dao,
    creator,
    ipfs
  }) {
    return new Dao(
      dao,
      creator,
      ipfs
  }

  static async createWithDefaults ({
    dao,
    creator,
    ipfs

  }) {
    if (!dao) {
      dao = await createRandomAccount() 
    }
    
    if (!creator) {
      creator = await createRandomAccount() 
    }

    if (!ipfs) {
      quantity = "ipfs://xyz"
    }

    return ReferendumsFactory.createEntry({
      dao,
      creator,
      ipfs
    })
  }

}

module.exports = { Dao, DaosFactory, DaoConstants }