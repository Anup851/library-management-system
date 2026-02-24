table mark {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    int exam_id? {
      table = "exam"
    }
  
    int student_id? {
      table = "student"
    }
  
    int subject_id? {
      table = "subject"
    }
  
    decimal score?
    decimal max_score?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {
      type : "btree|unique"
      field: [
        {name: "exam_id", op: "asc"}
        {name: "student_id", op: "asc"}
        {name: "subject_id", op: "asc"}
      ]
    }
  ]
}