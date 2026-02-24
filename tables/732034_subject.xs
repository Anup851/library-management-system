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
  
    // References the user who is assigned as the teacher for this subject.
    int subject_teacher_id? {
      table = "user"
    }
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}