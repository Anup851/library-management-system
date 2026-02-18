// Query all student records
query student verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query student {
      return = {type: "list"}
    } as $student
  }

  response = $student
}