# DataSvr

> ZGIS-DataSvr封装

## add

> 说明：添加一条数据（可以支持有ID，也可以支持无ID）

```javascript
static add(major, minor, att, retAtt = 0)
```

### 基础用法
```javascript
// 添加一条无ID的记录
uni.cxapp.DataSvr.add(98, 13, { name: '张三', age: 18 })

// 添加一条有ID的记录
uni.cxapp.DataSvr.add(98, 13, { id: 1, name: '张三', age: 18 })

// 添加并返回完整记录
uni.cxapp.DataSvr.add(98, 13, { name: '张三', age: 18 }, 1)
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- att: {Object} 待添加的属性数据对象，内部每个key的值只能是简单类型
- retAtt: {Number} 是否返回整条记录，默认为 0（不返回），1（返回）

返回：
- {Promise} 请求对象，数据结构 `{id: 31, ...}`

### 注意事项
1. 如果 att 中包含 id 且 id > 0，则使用 insertWithId，否则使用 insertNoId。
2. 确保 att 中的 id 被正确处理。

## addsNoId

> 说明：添加多条记录（无ID）

```javascript
static addsNoId(major, minor, params, count)
```

### 基础用法
```javascript
// 批量添加3条记录
uni.cxapp.DataSvr.addsNoId(98, 13, {
  name: '张三,李四,王五',
  age: '18,19,20',
  separator: ','
}, 3)
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- params: {Object} 参数（其他属性，按字段都放在params里面，字段多个值之间用 separator 分隔开）
  - separator: {String} 分隔符，默认为 ','
- count: {Number} 添加的记录数量

返回：
- {Promise} 请求对象

### 注意事项
1. params 中的值必须与 count 匹配，分隔符数量为 count - 1。

## addsJson

> 说明：批量添加数据

```javascript
static addsJson(major, minor, datas, retAtt)
```

### 基础用法
```javascript
// 批量添加多条记录
uni.cxapp.DataSvr.addsJson(98, 13, [
  { name: '张三', age: 18 },
  { name: '李四', age: 19 }
], 1)
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- datas: {Array<Object>} 待插入的数据对象序列
- retAtt: {Number} 是否返回整条记录，0（不返回），1（返回）

返回：
- {Promise} promise对象，返回数据对象序列或 `[{id: ..., ...}, ...]`；retAtt=0 表示对象中只有id

## del

> 说明：删除一条数据（根据ID）

```javascript
static del(major, minor, id, retAtt = 0)
```

### 基础用法
```javascript
// 删除ID为1的记录
uni.cxapp.DataSvr.del(98, 13, 1)

// 删除并返回被删除的完整记录
uni.cxapp.DataSvr.del(98, 13, 1, 1)
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- id: {Number} 对象的id
- retAtt: {Number} 是否返回整条记录，默认为 0（不返回），1（返回）

返回：
- {Promise} 请求对象，返回 `{id: 32, ret: 0}` 或完整的记录对象

## dels

> 说明：删除多条数据（根据ID）

```javascript
static dels(params)
```

### 基础用法
```javascript
// 删除多条记录
uni.cxapp.DataSvr.dels({
  major: 98,
  minor: 13,
  id: '1,2,3'
})
```

参数说明：
- params: {Object} 参数对象
  - major: {Number} 实体主类型
  - minor: {Number} 实体子类型
  - id: {String} 对象的id（多个ID之间用,分隔）

返回：
- {Promise} promise对象，返回数据对象序列

## update

> 说明：修改一条属性（根据ID）

```javascript
static update(major, minor, att, cols, retAtt)
```

### 基础用法
```javascript
// 更新单条记录
uni.cxapp.DataSvr.update(98, 13, {
  id: 1,
  name: '张三',
  age: 20
})

// 只更新指定字段并返回完整记录
uni.cxapp.DataSvr.update(98, 13, {
  id: 1,
  name: '张三',
  age: 20
}, 'name,age', 1)
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- att: {Object} 待更新的属性
  - id: {Number} 实体ID
- cols: {String} 如果只想更新部分列，可以用这个参数指明需要更新的列名（,分隔）
- retAtt: {Number} 是否返回更新后的整条记录，0（不返回），1（返回）

返回：
- {Promise} 请求对象，返回 `{id: 32, ret: 0}` 或完整的记录对象

### 示例
```javascript
// 示例：更新指定列
uni.cxapp.DataSvr.update(98, 13, { id: 1, fld1: '9', fld2: 'a' }, 'fld1,fld2')
```

## updates

> 说明：修改多个属性

```javascript
static updates(major, minor, params, cols)
```

### 基础用法
```javascript
// 批量更新多条记录
uni.cxapp.DataSvr.updates(98, 13, {
  id: '1,2,3',
  name: '张三,李四,王五',
  age: '20,21,22',
  _rcdnum: 3
})

// 只更新指定字段
uni.cxapp.DataSvr.updates(98, 13, {
  id: '1,2,3',
  name: '张三,李四,王五',
  age: '20,21,22',
  _rcdnum: 3
}, 'name,age')
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- params: {Object} 更新属性参数（其他属性，按字段都放在params里面，字段多个值之间用 separator 分隔开）
  - id: {String} 实体ID列表，用逗号分隔
  - _rcdnum: {Number} 记录数量
  - separator: {String} 分隔符，默认为 ','
  - [key: string]: {String} 字段值，用分隔符分隔
- cols: {String} 需要更新的列名，用逗号分隔

返回：
- {Promise} 请求对象

### 注意事项
1. params 中的值必须与 _rcdnum 匹配。
2. 如果指定 cols，只更新那些列。

### query

> 说明：查询（支持单表/联合/内置SQL/传入条件/分页/部分列/排序/自定义分隔符等）
> uni.cxapp.DataSvr.query中如果有pageno、pagesize 参数则会返回 {"total":3,"ret":0,"retType":1,"data":[...]}没有的话只返回[...]

```javascript
static query(major, minor, params, cacheKey)
```

#### 基础用法
```javascript

// 1、条件查询
uni.cxapp.DataSvr.query(98, 13, {
  args: [
    ['name', '=', '张三', null],
    ['age', '>', 18, 'and']
  ]
})
返回结果：[{"end_date":"2025-08-21","depart_audit_date":"","depart_audit_code":0}]

// 2、id0等于29并且带or查询
uni.cxapp.DataSvr.query(98, 13, {
  args: [
['and', ['id0', '=', 29, 'AND']],
['and', ['depart', 'like', '%55%', 'and'], ['position', 'like', '%55%', 'or']]
]
})
返回结果：[{"end_date":"2025-08-21","depart_audit_date":"","depart_audit_code":0}]

// 3、分页查询
uni.cxapp.DataSvr.query(98, 13, {
  args: [
    ['id', '>', '0', null]
  ],
  init: '0',
  pageno: '1',
  pagesize: '10',
  orderby: 'id DESC'
})
返回结果：{"total":3,"ret":0,"retType":1,"data":[{"end_date":"2025-08-21","depart_audit_date":"","depart_audit_code":0}]}


// 4、指定返回字段
uni.cxapp.DataSvr.query(98, 13, {
  cols: 'id,name,age',
  args: [
    ['id', '>', '0', null]
  ],
})
返回结果：[{"end_date":"2025-08-21","depart_audit_date":"","depart_audit_code":0}]

// 5、范围查询数据库必须配置
delete from cx_syscfg where no = 'srsSys';
INSERT INTO cx_syscfg(sys, no, namec, value, cata, memo) VALUES ('0', 'srsSys', '投影代码', '4326', null, '经纬度:4326、4490,墨卡托:3857、4549');
commit ;

// 5、范围查询
uni.cxapp.DataSvr.query(98, 13, {  
  args: [
    ['id', '>', 0, null]
  ],
  geometry: 1,
  geom: {
    'type': 'Point',
    'coordinates': [116.4, 39.9]
  },
  r: 5000
});
返回结果：[{"glid":19,"coor":"123.374,40.392","id":232,"geom":{"type":"Polygon","coordinates":[[[122.49508814,41.56003349],[122.48769855,41.54961139],[122.49508814,41.56003349]]]}}]

// 6、使用SqlExp表达式查询
uni.cxapp.DataSvr.query(98, 13, {
  _key: 'all'
})
返回结果：[{"end_date":"2025-08-21","depart_audit_date":"","depart_audit_code":0}]
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- params: {Object} 参数对象
  - _key: {String} SqlExp表达式名字，对应sqlexp表name
  - args: {Array} SQL列条件对象数组，[[fld1,oper,val,连接符]]，oper为：>,<,=,like,in等，连接符为：or，and，null
  - vals: {String} 替换sql中有?变量，以separator分隔
  - separator: {String} vals的分隔符，默认为 ','
  - cols: {String} 返回的列名（,分隔）
  - tables: {String} 联合查询的表名，以;分隔
  - orderby: {String} 排序字段
  - groupby: {String} 分组字段
  - geometry: {Number} 是否返回空间数据，默认0
  - geom: {GeoJson} 范围查询
  - r: {Number} 基于geom的缓冲区半径，单位m
  - init: {String} 分页标记（0/1，首次为0，非首次为1）
  - pageno: {String} 页码（从1开始）
  - pagesize: {String} 每页数据条数
- cacheKey: {String} 缓存键

返回：
- {Promise} promise对象，返回结构：不分页时 `[数据1,数据2,...]`；分页时 `[{ret: ,data: [数据1,数据2,...], total: }]`

#### 注意事项
1. 支持多种查询方式，包括联合查询和空间查询。
2. 如果使用缓存，会存储返回数据。
3. init/pageno/pagesize 三个参数同时传入才启用分页。

---

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- params: {Object} 参数对象
  - args: {Array} SQL列条件对象数组，[[fld1,oper,val,连接符]]，oper为：>,<,=,like,in等，连接符为：or，and，null
  - argstype: {String} args中参数的类型，逗号分隔
  - cols: {String} 返回的列名（,分隔）
  - tables: {String} 联合查询的表名，以;分隔
  - orderby: {String} 排序字段
  - groupby: {String} 分组字段
  - init: {String} 分页标记（0/1，首次为0，非首次为1）
  - pageno: {String} 页码（从1开始）
  - pagesize: {String} 每页数据条数
  - vals: {String} 替换值，用separator分隔
  - separator: {String} vals的分隔符，默认为 ','
  - geom: {GeoJson} 范围查询
  - r: {Number} 基于geom的缓冲区半径，单位m
- cacheKey: {String} 缓存键

返回：
- {Promise} promise对象，返回结构：不分页时 [数据1,数据2,...] ; 分页时 [{ret: ,data: [数据1,数据2,...], total: }]

### 注意事项
1. 支持多种查询方式，包括联合查询和空间查询。
2. 如果使用缓存，会存储返回数据。

## batch

> 说明：`uni.cxapp.DataSvr.batch` 支持一次性批量执行多条数据库操作，支持新增、删除、修改、查询，多条操作统一请求、批量返回结果。
> 参数为**操作对象数组**，数组内每一项代表一条独立数据库操作。
> 操作类型常量：
- `uni.cxapp.CxConst.SVR_ADD`：新增
- `uni.cxapp.CxConst.SVR_DEL`：删除
- `uni.cxapp.CxConst.SVR_UPD`：更新
- `uni.cxapp.CxConst.SVR_QRY`：查询

```javascript
static batch(data)
```

### 基础用法
```javascript
// 批量操作（增删改查）
uni.cxapp.DataSvr.batch([
  { type: uni.cxapp.CxConst.SVR_ADD, data: { _major: 98, _minor: 13, name: '张三', age: 18, retAtt: 1 } },
  { type: uni.cxapp.CxConst.SVR_DEL, data: { _major: 98, _minor: 13, id: 1, retAtt: 1  } },
  { type: uni.cxapp.CxConst.SVR_UPD, data: { _major: 98, _minor: 13, id: 2, name: '李四', retAtt: 1 } }
  { type: uni.cxapp.CxConst.SVR_QRY, data: { _major: 98, _minor: 13, args: "id:@:3:@:0:@:0" } }
])

## 3. 返回值规则

1. **数组长度映射规则**
返回结果为数组，**结果数组长度与请求操作数组长度完全一致**，下标顺序一一对应：
   - 请求数组包含 4 个操作对象 → 返回结果数组共 4 项；
   - 请求数组包含 3 个操作对象 → 返回结果数组共 3 项；
   - `result[0]` 对应第一条操作，`result[1]` 对应第二条操作，依次匹配。
2. **retAtt 返回控制规则**
   - `SVR_ADD`、`SVR_DEL`、`SVR_UPD`：只有参数中携带 `retAtt: 1`，接口才会返回操作对应的实体属性对象；未配置该参数时不返回业务实体数据。
   - `SVR_QRY`：不受 `retAtt` 参数影响，始终根据查询条件返回匹配的数据集合。
3. **统一返回结构**
每条操作结果固定格式：`{"data": [数据集]}`

> 无论返回单条或多条记录，数据均存放于`data`数组内。
 
返回示例：[{"data":[{"receive_unit":"长江中下游水文监测中心","warning_id":323},{"receive_unit":"长江中下游水文监测中心","warning_id":324}]},{"data":[...]},{"data":[...]},{"data":[...]}]
```

参数说明：
- data: {Array} 操作数组，每个元素包含 type 和 data
  - type: {String} 操作类型，如 SVR_ADD, SVR_DEL, SVR_UPD 等
  - data: {Object} 操作参数

返回：
- {Promise} promise对象，返回数据对象序列

## queryAll

> 说明：取全部数据

```javascript
static queryAll(major, minor, params, cacheKey)
```

### 基础用法
```javascript
// 查询全部数据
uni.cxapp.DataSvr.queryAll(98, 13, {})

// 指定返回字段并排序
uni.cxapp.DataSvr.queryAll(98, 13, {
  cols: 'id,name,age',
  orderby: 'age DESC'
})

// 使用缓存
uni.cxapp.DataSvr.queryAll(98, 13, {}, 'allUserList')
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- params: {Object} 参数
  - cols: {String} 返回列（如果不设置则返回全部列）
  - orderby: {String} 排序
- cacheKey: {String} 缓存键

返回：
- {Promise} 请求对象

## querySql

> 说明：用自定义sql查询数据，库中exp字段需要完整sql语句，支持占位符替换

```javascript
static querySql(params, cacheKey)
```

### 基础用法

```javascript
// 使用SQL模板查询
SQL脚本：
INSERT INTO cx_sqlexp (name, tab, tables, exp, types, vals, cols, sep, memo, exfld) VALUES ('mGsfpUserParam', null, null, 'SELECT u.id,u.username,u.realname,u.phone,o.type,o.rname,o.rphone,o.raddr FROM hr_user u INNER JOIN hr_gift_order o ON o.userid = u.id WHERE u.name = ? and u.age=?', 's,i', '{1},{2}', null, null, '查询用户+订单', null);
uni.cxapp.DataSvr.querySql({
  _key: 'mGsfpUserParam',
  vals: '18,98',
  separator: ','
})

// 分页查询
SQL脚本：
INSERT INTO cx_sqlexp (name, tab, tables, exp, types, vals, cols, sep, memo, exfld) VALUES ('mGsfpUserPage', null, null, 'SELECT u.id,u.username,u.realname,u.phone,o.type,o.rname,o.rphone,o.raddr FROM hr_user u INNER JOIN hr_gift_order o ON o.userid = u.id WHERE u.age=18', null, null, null, null, '查询用户+订单', null);
uni.cxapp.DataSvr.querySql({
  _key: 'mGsfpUserPage',
  init: '0',
  pageno: '1',
  pagesize: '10'
})

// 使用 args 条件查询
SQL脚本：
INSERT INTO cx_sqlexp (name, tab, tables, exp, types, vals, cols, sep, memo, exfld) VALUES ('mGsfpUserArgs', null, null, 'SELECT u.id,u.username,u.realname,u.phone,o.type,o.rname,o.rphone,o.raddr FROM hr_user u INNER JOIN hr_gift_order o ON o.userid = u.id WHERE @exp', null, null, null, null, '查询用户+订单', null);
uni.cxapp.DataSvr.querySql({
  _key: 'mGsfpUserArgs',
  args: [
    ['u.name', '=', '张三', null],
    ['u.age', '>', 18, 'and']
  ],
  argstype:'s,i'
})

// 使用 args + 排序 + 分页
uni.cxapp.DataSvr.querySql({
  _key: 'mGsfpUserArgs',
  args: [
    ['o.status', '=', 1, null]
  ],
  argstype: 'i',
  orderby: 'o.create_time DESC',
  init: '0',
  pageno: '1',
  pagesize: '20'
})
```

参数说明：
- params: {Object} 参数
  - _key: {String} 表达式名字，对应sqlexp表name
  - vals: {String} 替换sql中有 ? 变量，以separator分隔依次替换
  - separator: {String} 值vals的分隔符，默认为 ','
  - args: {Array} 替换sql中 @exp 占位，SQL列条件对象数组，格式 [[fld1,oper,val,连接符]]
    - fld: {String} 字段名
    - oper: {String} 操作符，支持 >、<、=、>=、<=、like、in、not in 等
    - val: {any} 比较值
    - 连接符: {String|null} 与前一个条件的连接符，支持 'or'、'and'，null 表示没有连接符
  - argstype: {String} args中参数的类型，逗号分隔。类型代码：
    - `s` - 字符串 (String)
    - `i` - 整数 (Integer)
    - `n` - 数字 (Number/Float)
    - `d` - 日期 (Date)
    - `b` - 布尔值 (Boolean)
    - 类型代码与 args 中的 val 按顺序一一对应
  - orderby: {String} 替换sql中 @orderby 占位
  - groupby: {String} 替换sql中 @groupby 占位
  - tables: {String} 替换sql中 @tab 占位，以 ; 分隔
  - cols: {String} 替换sql中 @col 占位，以 ; 分隔
  - geom: {GeoJson} 范围查询
  - r: {Number} 基于geom的缓冲区半径，单位m
  - init: {String} 分页标记（0/1）
  - pageno: {String} 页码
  - pagesize: {String} 每页数据条数
- cacheKey: {String} 缓存键

返回：
- {Promise} promise对象，返回结构：不分页时 [数据1,数据2,...] ; 分页时 [{ret: ,data: [数据1,数据2,...], total: }]

### 注意事项
1. SQL 模板需在库中预定义（对应 sqlexp 表的 exp 字段）。
2. 支持多种占位符替换：`?`（用 vals 替换）、`@exp`（用 args 替换）、`@orderby`（用 orderby 替换）、`@groupby`（用 groupby 替换）、`@tab`（用 tables 替换）、`@col`（用 cols 替换）。
3. 使用 args 参数时必须同时提供 argstype 参数，类型代码与 args 中每个条件的 val 按顺序一一对应。
4. args 中第一个条件的连接符应为 null，后续条件使用 'and' 或 'or' 连接。

## queryId

> 说明：根据id取实体（主要用于取部分列）

```javascript
static queryId(major, minor, id, cols, cacheKey)
```

### 基础用法
```javascript
// 根据ID查询
uni.cxapp.DataSvr.queryId(98, 13, 1)

// 指定列查询
uni.cxapp.DataSvr.queryId(98, 13, 1, 'id,name,age')

// 使用缓存
uni.cxapp.DataSvr.queryId(98, 13, 1, null, 'user_1')
```

参数说明：
- major: {Number} 实体主类型
- minor: {Number} 实体子类型
- id: {Number} 实体id
- cols: {String} 返回的列名（不传返回全部列）
- cacheKey: {String} 缓存键

返回：
- {Promise} 请求对象，返回数据结构 `{id: ..., ...}`

### 注意事项
1. 此方法已标记为 deprecated，请考虑使用其他查询方法。

## callProc

> 说明：调用存储过程

```javascript
static callProc(params)
```

### 基础用法
```javascript
// 调用存储过程
uni.cxapp.DataSvr.callProc({
  _key: 'procName',
  vals: '1,张三,18'
})

// 带特殊分隔符的调用
uni.cxapp.DataSvr.callProc({
  _key: 'procName',
  vals: '1|张三|18',
  separator: '|'
})
```

参数说明：
- params: {Object} 参数
  - _key: {Number} cx_sqlpro 表的name
  - vals: {Number} 参数值（用,分隔，与参数一一对应）

返回：
- {Promise} 请求对象

## getSequence

> 说明：根据主、子类型获取该类对象的唯一序号

```javascript
static getSequence(major, minor)
```

### 基础用法
```javascript
// 获取序列号
uni.cxapp.DataSvr.getSequence(98, 13)
```

参数说明：
- major: {Number} 表主类型
- minor: {Number} 表子类型

返回：
- {Promise} 请求对象，返回数据结构 `{id: ...}`

## getBill

> 说明：根据序列配置seqbill表和配置序列名 生成唯一序号

```javascript
static getBill(major, minor, name)
```

### 基础用法
```javascript
// 生成唯一序号
uni.cxapp.DataSvr.getBill(98, 13, 'ORDER_NO')
```

参数说明：
- major: {Number} 序列配置seqbill表主类型
- minor: {Number} 序列配置seqbill表子类型
- name: {String} 配置名称

返回：
- {Promise} 请求对象

## check

> 说明：检查服务可用性

```javascript
static check()
```

### 基础用法
```javascript
// 检查服务
uni.cxapp.DataSvr.check()
```

返回：
- {Promise} 请求对象

## 修改记录

```
24-05-04     郑朝军        首次提交
2024-10-24   Grok          完善文档，添加方法说明和注意事项
```