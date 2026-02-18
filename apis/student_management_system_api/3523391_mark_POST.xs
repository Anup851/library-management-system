// Add mark record
query mark verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "mark"
    }
  }

  stack {
    db.add mark {
      data = {created_at: "now"}
    } as $mark
  }

  response = $mark
}