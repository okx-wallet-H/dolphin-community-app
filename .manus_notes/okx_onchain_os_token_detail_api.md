# 项目信息 | Web3 开发者文档 | OKX

## 项目信息

查询单个币种的其他信息，诸如币种合约地址、代币官网 URL、社媒信息。

支持主链币、代币的项目信息

支持 Bitcoin 链上的 BRC-20、Runes、ARC-20、SRC-20 铭文代币的项目信息

Fractal Bitcoin 链上的 BRC-20 铭文代币的项目信息

请求路径#

GET https://web3.okx.com/api/v5/wallet/token/token-detail

请求参数#
Parameter Type Required Description
chainIndex String Yes 链唯一标识
tokenAddress String No 代币地址。
1：传""代表查询对应链的主链币。
2：传具体的代币合约地址，代表查询对应的代币。
3：不同铭文代币按如下格式入参：
FBRC-20: 使用 fbtc_fbrc20_name，如 fbtc_fbrc20_babymusk
BRC-20: 使用 btc-brc20-tick(name)，如 btc-brc20-ordi
Runes: 使用 btc-runesMain-tickId，如 btc-runesMain-840000:2
SRC-20:使用 btc-src20-name，如 btc-src20-utxo

响应参数#
Parameter Type Description
logoUrl String logo 地址
officialWebsite String 官方网站的地址
socialUrls Object 社交媒体
> twitter Array 如存在，则返回，否则不返回。
> facebook Array 如存在，则返回，否则不返回。
> reddit Array 如存在，则返回，否则不返回。
> messageboard Array 如存在，则返回，否则不返回。
> chat Array 如存在，则返回，否则不返回。
> github Array 如存在，则返回，否则不返回。
> whitepaper Array 如存在，则返回，否则不返回。
> announcement Array 如存在，则返回，否则不返回。
decimals String 代币精度
tokenAddress String 代币地址。为空 "" 代表返回结果是相关链，主链币的数据
chainIndex String 链唯一标识
chainName String 链名称
symbol String 代币简称
name String 代币名称
maxSupply String 最大供应量（多链汇总，部分代币数据为空）。精度15位
totalSupply String 总供应量（多链汇总，部分代币数据为空）。精度15位
volume24h String 24 小时交易额，单位为美元。精度15位。统计范围包括 OKX DEX 接入的所有流动性池。
marketCap String 项目市值，单位为美元。精度15位
请求示例#
Shell
curl --location --request GET 'https://web3.okx.com/api/v5/wallet/token/token-detail?chainIndex=56&""&tokenAddress=0x6f620ec89b8479e97a6985792d0c64f237566746' \
--header 'Content-Type: application/json' \
--header 'OK-ACCESS-PROJECT: 86af********d1bc' \
--header 'OK-ACCESS-KEY: 37c541a1-****-****-****-10fe7a038418' \
--header 'OK-ACCESS-SIGN: leaV********3uw=' \
--header 'OK-ACCESS-PASSPHRASE: 1****6' \
--header 'OK-ACCESS-TIMESTAMP: 2023-10-18T12:21:41.274Z'

响应示例#
Json
{
 "code": "0",
 "msg": "success",
 "data": [
 {
 "logoUrl": "https://static.oklink.com/cdn/web3/currency/token/bnb-wpc-0x6f620ec89b8479e97a6985792d0c64f237566746.png/type=png_350_0",
 "officialWebsite": "https://www.wepiggy.com/",
 "socialUrls": {
 "messageboard": [
 "https://wepiggy-com.medium.com/"
 ],
 "github": [
 "https://github.com/WePiggy"
 ],
 "twitter": [
 "https://twitter.com/wepiggydotcom"
 ],
 "chat": [
 "https://t.me/wepiggy;https://discord.com/invite/pew9k58"
 ],
 "reddit": [
 "https://reddit.com/r/WePiggy/"
 ]
 },
 "decimals": "18",
 "tokenAddress": "0x6f620ec89b8479e97a6985792d0c64f237566746",
 "chainIndex": "56",
 "chainName": "BNB Chain",
 "symbol": "wpc"，
 "circulatingSupply": "151703763.020000000000000",
 "maxSupply": "200000000.000000000000000",
 "totalSupply": "",
 "volume24h": "283632981.281666040000000",
 "marketCap": "34510982165.370000000000000"
 }
 ]
}
