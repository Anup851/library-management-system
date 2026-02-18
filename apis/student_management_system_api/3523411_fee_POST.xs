// Add fee record
query fee verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "fee"
    }
  }

  stack {
    db.add fee {
      data = {created_at: "now"}
    } as $fee
  }

  response = $fee
}