table attendance {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    int student_id? {
      table = "student"
    }
  
    int class_id? {
      table = "class"
    }
  
    date date?
    text status?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {
      type : "btree|unique"
      field: [{name: "student_id", op: "asc"}, {name: "date", op: "asc"}]
    }
  ]
}