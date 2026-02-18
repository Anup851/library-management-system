// Query all attendance records
query attendance verb=GET {
  api_group = "Student Management System API"

  input {
  }

  stack {
    db.query attendance {
      return = {type: "list"}
    } as $attendance
  }

  response = $attendance
}