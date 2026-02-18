// Delete class record.
query "class/{class_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int class_id? filters=min:1
  }

  stack {
    db.del class {
      field_name = "id"
      field_value = $input.class_id
    }
  }

  response = null
}