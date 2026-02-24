table student {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    int user_id? {
      table = "user"
    }
  
    text roll_no?
    text name?
    email email?
    text phone?
    text gender?
    date dob?
    text address?
    int class_id? {
      table = "class"
    }
  
    date admission_date?
    text status?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree|unique", field: [{name: "roll_no", op: "asc"}]}
  ]
}