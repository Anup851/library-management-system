// Query all mark records
query mark verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query mark {
      return = {type: "list"}
    } as $mark
  }

  response = $mark
}