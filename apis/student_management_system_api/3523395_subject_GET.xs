// Query all subject records
query subject verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query subject {
      return = {type: "list"}
    } as $subject
  }

  response = $subject
}