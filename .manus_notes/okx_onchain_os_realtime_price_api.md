## OKX Onchain OS 实时币价 API

**功能:** 批量查询币种的实时价格。
**限制:** 只支持代币（非主网币）的实时币价，每次最多可以批量查询 100 个代币。

**请求路径:**
`POST https://web3.okx.com/api/v5/wallet/token/real-time-price`

**请求参数:**
| Parameter    | Type   | Required | Description      |
|--------------|--------|----------|------------------|
| `chainIndex` | String | Yes      | 链唯一标识       |
| `tokenAddress` | String | Yes      | 代币地址         |

**响应参数:**
| Parameter    | Type   | Description                               |
|--------------|--------|-------------------------------------------|
| `price`      | String | 代币价格，单位为美元                      |
| `time`       | String | 价格的时间，Unix 时间戳格式，用毫秒表示 |
| `chainIndex` | String | 链唯一标识                                |
| `tokenAddress` | String | 代币地址                                  |

**请求示例:**
```shell
curl --location --request POST 'https://web3.okx.com/api/v5/wallet/token/real-time-price' \
--header 'Content-Type: application/json' \
--header 'OK-ACCESS-PROJECT: 86af********d1bc' \
--header 'OK-ACCESS-KEY: 37c541a1-****-****-****-10fe7a038418' \
--header 'OK-ACCESS-SIGN: leaV********3uw=' \
--header 'OK-ACCESS-PASSPHRASE: 1****6' \
--header 'OK-ACCESS-TIMESTAMP: 2023-10-18T12:21:41.274Z' \
--data-raw '[
 {
 "chainIndex": "1",
 "tokenAddress":"0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
 }
 ]'
```

**响应示例:**
```json
{
 "code": "0",
 "msg": "success",
 "data": [
 {
 "chainIndex": "1",
 "tokenAddress": "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
 "time": "1716892020000",
 "price": "26.458143090226812",
 }
 ]
}
```
