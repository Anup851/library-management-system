// Get fee record
query "fee/{fee_id}" verb=GET {
  api_group = "Student Management System API"

  input {
    int fee_id? filters=min:1
  }

  stack {
    db.get fee {
      field_name = "id"
      field_value = $input.fee_id
    } as $fee
  
    precondition ($fee != null) {
      error_type = "notfound"
      error = "Not Found."
    }
  }

  response = $fee
}