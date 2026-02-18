// Query all fee records
query fee verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query fee {
      return = {type: "list"}
    } as $fee
  }

  response = $fee
}