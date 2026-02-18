table exam {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    text title?
    int class_id? {
      table = "class"
    }
  
    date start_date?
    date end_date?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}