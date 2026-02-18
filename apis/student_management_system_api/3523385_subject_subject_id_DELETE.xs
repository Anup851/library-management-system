// Delete subject record.
query "subject/{subject_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int subject_id? filters=min:1
  }

  stack {
    db.del subject {
      field_name = "id"
      field_value = $input.subject_id
    }
  }

  response = null
}