// Delete fee record.
query "fee/{fee_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int fee_id? filters=min:1
  }

  stack {
    db.del fee {
      field_name = "id"
      field_value = $input.fee_id
    }
  }

  response = null
}