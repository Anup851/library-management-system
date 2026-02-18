// Add attendance record
query attendance verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "attendance"
    }
  }

  stack {
    db.add attendance {
      data = {created_at: "now"}
    } as $attendance
  }

  response = $attendance
}