// Edit attendance record
query "attendance/{attendance_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int attendance_id? filters=min:1
    dblink {
      table = "attendance"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch attendance {
      field_name = "id"
      field_value = $input.attendance_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $attendance
  }

  response = $attendance
}