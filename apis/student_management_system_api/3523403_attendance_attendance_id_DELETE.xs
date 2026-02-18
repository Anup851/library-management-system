// Delete attendance record.
query "attendance/{attendance_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int attendance_id? filters=min:1
  }

  stack {
    db.del attendance {
      field_name = "id"
      field_value = $input.attendance_id
    }
  }

  response = null
}