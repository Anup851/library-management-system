// Edit fee record
query "fee/{fee_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int fee_id? filters=min:1
    dblink {
      table = "fee"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch fee {
      field_name = "id"
      field_value = $input.fee_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $fee
  }

  response = $fee
}