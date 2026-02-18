// Delete exam record.
query "exam/{exam_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int exam_id? filters=min:1
  }

  stack {
    db.del exam {
      field_name = "id"
      field_value = $input.exam_id
    }
  }

  response = null
}