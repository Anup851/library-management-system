// Add class record
query class verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "class"
    }
  }

  stack {
    db.add class {
      data = {created_at: "now"}
    } as $class
  }

  response = $class
}