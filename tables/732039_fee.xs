table fee {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    int student_id? {
      table = "student"
    }
  
    decimal amount?
    timestamp payment_date?
    text method?
    text receipt_no?
    text description?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {
      type : "btree|unique"
      field: [{name: "receipt_no", op: "asc"}]
    }
  ]
}