const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance, initContract, randomAccountName } = require('../scripts/eosio-util')
const { daosAccounts } = require('../scripts/daos-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')
const { AssertionError } = require('assert/strict')
const { createAccount, deployContract } = require('../scripts/deploy')

const { daoreg, daoinf, tlostoken } = contractNames
const { firstuser, seconduser, thirduser, fourthuser } = daosAccounts

// definir publicKey 
const publicKey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';
// definir creator
const creator = 'eosio';

async function createTokenContract() {
    const account = await randomAccountName()
    await createAccount({account, publicKey, creator})
    await deployContract({
        name: 'tlostoken',
        nameOnChain: account
    })
    const token_contract = await initContract(account)
    return [ token_contract, account ]
}

async function createTokenAndTransfer(token_contract, account, issuer, tester1, tester2, max_supply, quantity_issue, quantity_transfer) {
 
    await token_contract.create(issuer, max_supply, {authorization: `${account}@active`})
    await token_contract.issue(issuer, quantity_issue, '', { authorization: `${issuer}@active`})
    await token_contract.transfer(issuer, tester1, quantity_transfer, '', { authorization: `${issuer}@active`})
    await token_contract.transfer(issuer, tester2, quantity_transfer, '', { authorization: `${issuer}@active`})
    // await token_contract.transfer(issuer, tester3, quantity_transfer, '', { authorization: `${issuer}@active`})
    
}

describe('Dao registry', async function () {
    let contracts;
    let daousers;
    let tester1, tester2 //, tester3

    before(async function () {
        if (!isLocalNode()) {
            console.log('These test should only be run on local node')
            process.exit(1)
        }
        contracts = await getContracts([daoreg, tlostoken]) // ??
        daousers = [firstuser, seconduser, thirduser]
        await setParamsValue()

        tester1 = await randomAccountName();
        await createAccount({ account: tester1, publicKey, creator })

        tester2 = await randomAccountName();
        await createAccount({ account: tester2, publicKey, creator })

        // tester3 = await randomAccountName();
        // await createAccount({ account: tester3, publicKey, creator })

        try {
            await contracts.tlostoken.create(tlostoken, "10000000000.0000 TLOS", { authorization: `${tlostoken}@active` })
            await contracts.tlostoken.issue(tlostoken, "10000000000.0000 TLOS", '', { authorization: `${tlostoken}@active` })
        } catch (error) {
            assertError({
                error,
                textInside: 'token with symbol already exists',
                message: 'Token symbol already registered (expected)',
                throwError: true
            })
        }
        await contracts.tlostoken.transfer(tlostoken, tester1, "100.0000 TLOS", '', { authorization: `${tlostoken}@active` })
        await contracts.tlostoken.transfer(tlostoken, tester2, "100.0000 TLOS", '', { authorization: `${tlostoken}@active` })
        // await contracts.tlostoken.transfer(tlostoken, tester3, "100.0000 TLOS", '', { authorization: `${tlostoken}@active` })

    })

    beforeEach(async function () {
        await contracts.daoreg.reset({ authorization: `${daoreg}@active` })
    })

    it('Settings, set a new param', async function () {
        await contracts.daoreg.setparam(
            'testparam',
            ['uint64', 20],
            'test param',
            { authorization: `${daoreg}@active` }
        )

        const settingParam = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'config',
            json: true,
            limit: 100
        })
        console.log(JSON.stringify(settingParam, null, 2))

        // aqui tambien asserts
    })

    it('Create DAO', async function () {
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        let daoCreation = true;
        try {
            await contracts.daoreg.create(
                'dao.org2',
                firstuser,
                'HASH_2',
                { authorization: `${daoinf}@active` })
            daoCreation = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of testuseraaa`,
                message: 'user must be have authorization (expected)',
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: 'dao.org1',
                creator: daoreg,
                ipfs: 'HASH_1',
                attributes: [],
                tokens: []
            }
        ])

        assert.deepStrictEqual(daoCreation, true)
    })

    it('Update IPFS DAO', async function () {
        // create DAO
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // update DAO by the creator
        await contracts.daoreg.update(
            1,
            'NEW_HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // DAO cannot be updated by someone else
        let updateIpfsOnlyOwner = true
        try {
            await contracts.daoreg.update(
                1,
                'NEW_HASH_2',
                { authorization: `${daoinf}@active` })
            updateIpfsOnlyOwner = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of daoregistry`,
                message: 'dao cannot be updated by someone else (expected)',
                throwError: true
            })
        }

        // Fails if DAO is not found
        let updateIpfsIfFound = true
        try {
            await contracts.daoreg.update(
                2,
                'NEW_HASH3',
                { authorization: `${daoreg}@active` })
            updateIpfsIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: 'dao.org1',
                creator: daoreg,
                ipfs: 'NEW_HASH_1',
                attributes: [],
                tokens: []
            }
        ])

        assert.deepStrictEqual(updateIpfsOnlyOwner, true)
        assert.deepStrictEqual(updateIpfsIfFound, true)
    })

    it('Delete DAO', async function () {
        // create DAO
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // DAO can only be deleted by creator
        let deleteDaoByCreator = true
        try {
            await contracts.daoreg.delorg(
                1,
                { authorization: `${daoinf}@active` })
            deleteDaoByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of daoregistry1`,
                message: 'users can not delete dao (expected)',
                throwError: true
            })
        }

        // Fails if DAO is not found
        let deleteDaoIfFound = true
        try {
            await contracts.daoreg.delorg(
                2,
                { authorization: `${daoreg}@active` })
            deleteDaoIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        // delete DAO
        await contracts.daoreg.delorg(
            1,
            { authorization: `${daoreg}@active` }
        )

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [])
        assert.deepStrictEqual(deleteDaoByCreator, true)
        assert.deepStrictEqual(deleteDaoIfFound, true)
    })

    it('Upsert attributes', async function () {
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // add-modify attributes can only be done by creator 
        let upsertattrsByCreator = true
        try {
            await contracts.daoreg.upsertattrs(
                1,
                [
                    { first: "first attribute", second: ['uint64', 001] },
                    { first: "second attribute", second: ['string', 'DAOO'] },
                ],
                { authorization: `${daoinf}@active` })
            upsertattrsByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of daoregistry1`,
                message: 'add or modify attributes can only be done by creator',
                throwError: true
            })
        }

        // Fails if DAO is not found
        let upsertattrsDaoIfFound = true
        try {
            await contracts.daoreg.upsertattrs(
                2,
                [
                    { first: "first attribute", second: ['uint64', 007] },
                    { first: "second attribute", second: ['string', 'this should fail'] },
                ],
                { authorization: `${daoreg}@active` })
            upsertattrsDaoIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        // add some attributes
        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['uint64', 001] },
                { first: "second attribute", second: ['string', 'DAOO'] }
            ],
            { authorization: `${daoreg}@active` }
        )

        // update attribute
        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['string', 'updated attribute'] }
            ],
            { authorization: `${daoreg}@active` }
        )

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: 'dao.org1',
                creator: daoreg,
                ipfs: 'HASH_1',
                attributes: [
                    {
                        "first": "first attribute",
                        "second": [
                            "string", "updated attribute"
                        ]
                    },
                    {
                        "first": "second attribute",
                        "second": [
                            "string", "DAOO"
                        ]
                    }
                ],
                tokens: []
            }
        ])
        assert.deepStrictEqual(upsertattrsByCreator, true)
        assert.deepStrictEqual(upsertattrsDaoIfFound, true)
    })

    it('Deletes attributes', async function () {
        // create DAO
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // add some attributes
        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['uint64', 001] },
                { first: "second attribute", second: ['string', 'DAOO'] },
                { first: "third attribute", second: ['int64', -2] },
                { first: "fourth attribute", second: ['string', 'number 4'] },
            ],
            { authorization: `${daoreg}@active` }
        )
        // attributes can only be deleted by creator
        let deleteAttrsByCreator = true
        try {
            await contracts.daoreg.delattrs(
                1,
                ['first attribute'],
                { authorization: `${daoinf}@active` })
            deleteAttrsByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of daoregistry1`,
                message: 'attributes can only be deleted by creator',
                throwError: true
            })
        }

        // Fails if DAO is not found
        let deleteAttrsDaoIfFound = true
        try {
            await contracts.daoreg.upsertattrs(
                2,
                [
                    { first: "first attribute", second: ['uint64', 007] },
                    { first: "second attribute", second: ['string', 'this should fail'] },
                ],
                { authorization: `${daoreg}@active` })
            deleteAttrsDaoIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        // delete attributes, fifth attribute does not exists
        await contracts.daoreg.delattrs(
            1,
            ['first attribute', 'fourth attribute', 'fifth attribute'],
            { authorization: `${daoreg}@active` }
        )

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: 'dao.org1',
                creator: daoreg,
                ipfs: 'HASH_1',
                attributes: [
                    {
                        "first": "second attribute",
                        "second": [
                            "string", "DAOO"
                        ]
                    },
                    {
                        "first": "third attribute",
                        "second": [
                            "int64", -2
                        ]
                    }
                ],
                tokens: []
            }
        ])
        assert.deepStrictEqual(deleteAttrsByCreator, true)
        assert.deepStrictEqual(deleteAttrsDaoIfFound, true)
    })

    it('Adds token correctly', async function () {
        // create DAO
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // Fails if DAO is not found
        let addTokenDaoIfFound = true
        try {
            await contracts.daoreg.addtoken(
                2,
                'token.c',
                `4,CTK`,
                { authorization: `${daoreg}@active` })
            addTokenDaoIfFound= false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        // add token can be done only by creator
        let addTokenByCreator = true
        try {
            await contracts.daoreg.addtoken(
                1,
                'token.c',
                `4,CTK`,
                { authorization: `${daoinf}@active` })
            addTokenByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of daoregistry1`,
                message: 'token can be added only by creator (expected)',
                throwError: true
            })
        }

        // add token
        await contracts.daoreg.addtoken(
            1,
            'token.c',
            `4,CTK`,
            { authorization: `${daoreg}@active` }
        )

        // add token can not be done if the token is already added
        let tokenExists = true
        try {
            await contracts.daoreg.addtoken(
                1,
                'token.c',
                `4,CTK`,
                { authorization: `${daoreg}@active` })
            tokenExists = false
        } catch (error) {
            assertError({
                error,
                textInside: 'This token symbol is already added',
                message: 'can not add a token that is already added (expected)',
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))
        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: 'dao.org1',
                creator: daoreg,
                ipfs: 'HASH_1',
                attributes: [],
                tokens: [
                    {
                        "first": "token.c",
                        "second": "4,CTK" 
                    }
                ]
            }
        ])
        assert.deepStrictEqual(addTokenDaoIfFound, true)
        assert.deepStrictEqual(addTokenByCreator, true)
        assert.deepStrictEqual(tokenExists, true)
    })

    it('Reset settings', async function () {
        await contracts.daoreg.resetsttngs({ authorization: `${daoreg}@active` })

        let resetByDaoreg = true
        try {
            await contracts.daoreg.resetsttngs(
                { authorization: `${daoinf}@active` })
            resetByDaoreg = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of daoregistry1`,
                message: 'users can not reset settings (expected)',
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [])
        assert.deepStrictEqual(resetByDaoreg, true)
    })

    it('Accepts deposits correctly', async function () {
        // create DAO
        await contracts.daoreg.create(
            'dao.org1',
            daoreg,
            'HASH_1',
            { authorization: `${daoreg}@active` }
        )

        // create token1 contract and account1
        const [token1_contract, account1] = await createTokenContract();

        // create, issue and tranfer token1 to users, by daoreg
        await createTokenAndTransfer(
            token1_contract, 
            account1, 
            daoreg,
            tester1,
            tester2,
            // tester3,
            "10000.0000 DTK", 
            "4000.0000 DTK", 
            "1000.0000 DTK"
        )

        let balances_table = await rpc.get_table_rows({
            code: account1,
            scope: tester1,
            table: 'accounts',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(balances_table.rows, [
            {
                balance: "1000.0000 DTK"
            }
        ])

        let balances_table = await rpc.get_table_rows({
            code: account1,
            scope: tester2,
            table: 'accounts',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(balances_table.rows, [
            {
                balance: "1000.0000 DTK"
            }
        ])

        // create token2 contract and account2
        const [token2_contract, account2] = await createTokenContract();

        // create, issue and tranfer token2 to users, by fourthuser
        await createTokenAndTransfer(
            token2_contract,
            account2,
            daoinf,
            tester1,
            tester2,
            // tester3,
            "10000.0000 BTK",
            "4000.0000 BTK",
            "1000.0000 BTK"
        )

        balances_table = await rpc.get_table_rows({
            code: account2,
            scope: tester1,
            table: 'accounts',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(balances_table.rows, [
            {
                balance: "1000.0000 BTK"
            }
        ])

        balances_table = await rpc.get_table_rows({
            code: account2,
            scope: tester2,
            table: 'accounts',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(balances_table.rows, [
            {
                balance: "1000.0000 BTK"
            }
        ])

        // add token1 to daoreg
        await contracts.daoreg.addtoken(
            1,
            account1,
            `4,DTK`,
            { authorization: `${daoreg}@active` }
        )

        balances_table = await rpc.get_table_rows({
            code: tlostoken,
            scope: tester1,
            table: 'accounts',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(balances_table.rows, [
            {
                balance: "100.0000 TLOS"
            }
        ])

        // await token1_contract.transfer(tester1, daoreg, "10.0000 DTK", "1", {authorization: `${tester1}@active`})
  /*
        try{ 
            await token1_contract.transfer(tester1, daoreg, "10.0000 BTK", "0", { authorization: `${tester1}@active` })
        } catch (error) {
            console.log(error)
        }
   */     

        try {
            await token1_contract.transfer(tester1, daoreg, "10.0000 DTK", "", { authorization: `${tester1}@active` })
        } catch (error) {
            assertError({
                error,
                textInside: 'Memo can not be empty, especify dao_id',
                message: 'Fail if memo is empty (expected)',
                throwError: true
            })
        }

        balances_table = await rpc.get_table_rows({
            code: account1,
            scope: tester1,
            table: 'accounts',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(balances_table, null, 2))
        
        // users envian tokens al contrato
        // checar que realemente se agreguen al balance 
        // hacer otro token, mandarlo a los usuarios pero no agregarlo al dao y comprobar que falla
        // usuarios retiran tokens del contrato
        // usuario intenta retirar mas de lo que tiene y comprobar el error
        // usuario intenta retirar un token que no tienen y comprobar el error
        // checar que realmente se reste del balance 
    })
})