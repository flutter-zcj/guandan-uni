1、支持自然语言转sql 查询，并提供数据表关系可视化功能
2、接口约定
- 使用服务器 API（在 server/api 目录中）处理服务器端操作，如数据库交互、身份验证或处理必须保密的敏感数据

后端和数据库
使用 Supabase 进行后端服务，包括身份验证和数据库交互
遵循 Supabase 的安全和性能指南
使用 Zod 模式验证与后端交换的数据

当前用户密码：
Zyvwin-pexsyp-8gicji



后端提示词
请帮我开发一个基于springboot3 的后端项目，项目要实现以下4个接口
1.查询所有待办事项
 接口名：POST /api/get-todo
 功能：从数据库的Ilis：集合中查询井返回所有德办甲 应
 參数；无
 返回：包含所有待办事项的数组

2. 添加新的待办事项
接口名：POST lapiadd-todo
功能：向list"集合中添加新的待办事项
参数：{"value"： string  1、待办事项的具体内容
       isCompleted”：boolean // 是否完成，默认为 false
     }
返回：新添加的待办事项对象，包含自动生成的唯一id

3. 更新待办事项状态
接口名：POST /api/update-todo/
功能：根据 id 更新指定待办事项的完成状态（将 isCompleted 偵取反）
參数：id
返回：更新后的待办事项则象

4.删除待办事项
接口名：POST /apijdel-todo/
功能：根据id 删除指定的待办事项
参数；id
返回：删除操作的结果状态

技术要求：
1. 使用 hibernate 框架构建 API
2. 使用PostgreSQL数据库
3. 使用springboot3 框架

以下是数据库连接方式：
postgresql://postgres:q4dfhwlt@gisxjkc-postgresql.ns-zueo95to.svc:5432

1、直接以当前目录作为项目根目录，注意此项目已经初始化完成了，直接修改就可以
2、如果需要执行命令，请暂停创建文件，让我执行命令
为这个项目中所有代码写上详细注释





这是我们的根地址 @https://qagmscfbnlgx.sealoshzh.site 请帮我生成这四个接口的测试用例 以及接口成功和不成功的返回值

结果：
查询所有待办事项 (Get All Todos)

# 测试成功情况 (Success case)
curl -X POST https://qagmscfbnlgx.sealoshzh.site/api/get-todo
# 成功返回示例 (Success response)
[
    {
        "id": 1,
        "value": "完成报告",
        "isCompleted": false
    },
    {
        "id": 2,
        "value": "开会",
        "isCompleted": true
    }
]

# 失败返回示例 (Error response) - 服务器错误
{
    "timestamp": "2024-01-01T12:00:00.000+00:00",
    "status": 500,
    "error": "Internal Server Error",
    "message": "数据库连接失败"
}