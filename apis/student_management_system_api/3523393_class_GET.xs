// Query all class records
query class verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query class {
      return = {type: "list"}
    } as $class
  }

  response = $class
}