// Delete mark record.
query "mark/{mark_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int mark_id? filters=min:1
  }

  stack {
    db.del mark {
      field_name = "id"
      field_value = $input.mark_id
    }
  }

  response = null
}