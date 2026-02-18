table subject {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    text name?
    text code?
    int class_id? {
      table = "class"
    }
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}