// Query all exam records
query exam verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query exam {
      return = {type: "list"}
    } as $exam
  }

  response = $exam
}