table class {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    text name?
    text section?
    int user_id? {
      table = "user"
    }
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}