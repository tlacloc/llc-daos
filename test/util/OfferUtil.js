const { createRandomAccount } = require('../../scripts/eosio-util')

const OfferConstants = {
  sell: 0,
  buy: 1,
}

class Offer {

  constructor (
    daoId,
    creator,
    quantity,
    price_per_unit,
    type
  ) {
    this.params = {
      daoId,
      creator,
      quantity,
      price_per_unit,
      type
    }
  }

  getActionParams () {

    let daoId
    if (this.params.daoId) {
      daoId = this.params.daoId
    } else {
      daoId = 1
    }

    return [
      this.params.daoId,
      this.params.creator,
      this.params.quantity,
      this.params.price_per_unit,
      this.params.type
    ]
  }

}

class OffersFactory {

  static createEntry ({
    daoId,
    creator,
    quantity,
    price_per_unit,
    type
  }) {
    return new Offer(
      daoId,
      creator,
      quantity,
      price_per_unit,
      type)
  }

  static async createWithDefaults ({
    daoId,
    creator,
    quantity,
    price_per_unit,
    type

  }) {
    daoId = isFinite(daoId) ? daoId : 1
    
    if (!creator) {
      creator = await createRandomAccount() 
    }

    if (!quantity) {
      quantity = "1.0000 DTK"
    }

    if (!price_per_unit) {
      price_per_unit = "1.0000 TLOS"
    }

    if (!type) {
      type = 1 // type_buy_offer by default
    }

    return OffersFactory.createEntry({
      daoId,
      creator,
      quantity,
      price_per_unit,
      type
    })
  }

  static Status () {
    return {
      closed : 0,
      active : 1
    }
  }

}

module.exports = { Offer, OffersFactory, OfferConstants }