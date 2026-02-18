// Edit exam record
query "exam/{exam_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int exam_id? filters=min:1
    dblink {
      table = "exam"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch exam {
      field_name = "id"
      field_value = $input.exam_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $exam
  }

  response = $exam
}